import { useState } from 'react';
import type { Attachment } from '../types';
import { useDriveAttachments } from './useDriveAttachments';
import { fetchFileContentFromDrive, uploadFile, getOrCreateTripFileFolder } from './googleDrive';
import { GeminiService } from './ai';

interface UseReservationAttachmentsProps<T> {
  googleToken?: string;
  tripPlannerFolderId?: string;
  tripName?: string;
  tripFilesFolderId?: string;
  onFileFolderCreated?: (folderId: string) => void;
  initialAttachments: Attachment[];
  /** Entity-specific AI call that extracts details from raw file bytes. */
  generateFromFiles: (files: { base64: string; mimeType: string }[]) => Promise<T>;
  /** Entity-specific application of the extracted result to modal state. */
  applyResult: (result: T) => void | Promise<void>;
}

/**
 * One path for reservation-modal attachments: wraps {@link useDriveAttachments}
 * (upload/rename/remove) and adds the shared AI file-fill mechanics + the
 * `aiError` / `showAccessError` / `isAiFilling` state that HotelModal,
 * TransportModal, and PlaceReservationModal previously each hand-rolled.
 *
 * File-extraction AI necessarily bypasses `runAiCall` (manual mode can't pipe
 * file bytes — documented exception). The disabled/manual gating lives here so
 * every reservation modal handles the three AI modes identically.
 */
export function useReservationAttachments<T>({
  googleToken,
  tripPlannerFolderId,
  tripName,
  tripFilesFolderId,
  onFileFolderCreated,
  initialAttachments,
  generateFromFiles,
  applyResult,
}: UseReservationAttachmentsProps<T>) {
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAccessError, setShowAccessError] = useState(false);
  const [isAiFilling, setIsAiFilling] = useState(false);

  const drive = useDriveAttachments({
    googleToken,
    tripPlannerFolderId,
    tripName,
    tripFilesFolderId,
    onFileFolderCreated,
    initialAttachments,
    onSetAiError: setAiError,
    onAccessError: () => setShowAccessError(true),
  });

  const errorMessage = (err: unknown, fallback: string) =>
    err instanceof Error && err.message ? err.message : fallback;

  /** Fill from files already attached to the reservation. */
  const handleAiFill = async () => {
    if (!googleToken || drive.attachedFiles.length === 0) return;
    // Defense-in-depth: the trigger button is already disabled in these modes.
    if (!GeminiService.isAiEnabled() || GeminiService.isManualMode()) return;
    setIsAiFilling(true);
    setAiError(null);
    try {
      const fileContents = await Promise.all(
        drive.attachedFiles.map(f => fetchFileContentFromDrive(googleToken, f.fileId))
      );
      await applyResult(await generateFromFiles(fileContents));
    } catch (err) {
      setAiError(errorMessage(err, 'AI fill failed.'));
    } finally {
      setIsAiFilling(false);
    }
  };

  /** Upload a fresh file, then fill from it (the "Upload & Auto-Fill" button). */
  const handleAutofillFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = '';

    const file = files[0];
    setIsAiFilling(true);
    setAiError(null);
    try {
      const fileData = await new Promise<{ base64: string; mimeType: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const result = reader.result as string;
          const commaIdx = result.indexOf(',');
          resolve({
            base64: commaIdx > -1 ? result.substring(commaIdx + 1) : result,
            mimeType: file.type || 'application/octet-stream',
          });
        };
        reader.onerror = () => reject(new Error('Failed to read file locally.'));
      });

      if (googleToken) {
        let folderId = tripFilesFolderId;
        if (!folderId && tripPlannerFolderId && tripName) {
          folderId = await getOrCreateTripFileFolder(googleToken, tripPlannerFolderId, tripName);
          onFileFolderCreated?.(folderId);
        }
        if (folderId) {
          const fileId = await uploadFile(googleToken, folderId, file);
          drive.setAttachments(prev => [...prev, { name: file.name, filename: file.name, fileId }]);
        }
      }

      await applyResult(await generateFromFiles([fileData]));
    } catch (err) {
      setAiError(errorMessage(err, 'AI autofill failed.'));
    } finally {
      setIsAiFilling(false);
    }
  };

  return {
    ...drive,
    aiError,
    setAiError,
    showAccessError,
    setShowAccessError,
    isAiFilling,
    handleAiFill,
    handleAutofillFileSelect,
  };
}

export type ReservationAttachments = ReturnType<typeof useReservationAttachments>;
