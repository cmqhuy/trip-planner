import { useState, useEffect } from 'react';
import type { Attachment } from '../types';
import {
  getOrCreateTripFileFolder,
  uploadFile,
  deleteFileFromDrive,
  renameFolderInDrive,
} from './googleDrive';

interface UseDriveAttachmentsProps {
  googleToken?: string;
  tripPlannerFolderId?: string;
  tripName?: string;
  tripFilesFolderId?: string;
  onFileFolderCreated?: (folderId: string) => void;
  initialAttachments: Attachment[];
  onSetAiError: (error: string | null) => void;
}

export function useDriveAttachments({
  googleToken,
  tripPlannerFolderId,
  tripName,
  tripFilesFolderId,
  onFileFolderCreated,
  initialAttachments,
  onSetAiError,
}: UseDriveAttachmentsProps) {
  const [attachedFiles, setAttachments] = useState<Attachment[]>(initialAttachments);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [removePrompt, setRemovePrompt] = useState<Attachment | null>(null);

  const initialAttachmentsStr = JSON.stringify(initialAttachments || []);
  useEffect(() => {
    setAttachments(initialAttachments);
  }, [initialAttachmentsStr]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolveFilesFolderId = async (): Promise<string | null> => {
    if (tripFilesFolderId) return tripFilesFolderId;
    if (!googleToken || !tripPlannerFolderId || !tripName) return null;
    try {
      const folderId = await getOrCreateTripFileFolder(googleToken, tripPlannerFolderId, tripName);
      onFileFolderCreated?.(folderId);
      return folderId;
    } catch {
      return null;
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !googleToken) return;
    e.target.value = '';

    setUploadingCount(prev => prev + files.length);
    const folderId = await resolveFilesFolderId();
    if (!folderId) {
      setUploadingCount(prev => prev - files.length);
      onSetAiError('Could not create Drive folder. Make sure you are signed into Google.');
      return;
    }

    for (const file of files) {
      try {
        const fileId = await uploadFile(googleToken, folderId, file);
        setAttachments(prev => [...prev, { name: file.name, fileId }]);
      } catch (err: any) {
        if (err?.status === 403) {
          onSetAiError(`No write access to the trip folder. Ask the trip owner to share the folder with you.`);
        } else {
          onSetAiError(`Failed to upload "${file.name}".`);
        }
      } finally {
        setUploadingCount(prev => prev - 1);
      }
    }
  };

  const handleRemoveChip = (file: Attachment) => {
    setRemovePrompt(file);
  };

  const confirmRemoveChip = async (action: 'delete' | 'archive' | 'keep') => {
    if (!removePrompt) return;
    const file = removePrompt;
    setRemovePrompt(null);
    if (action === 'delete' && googleToken) {
      try { await deleteFileFromDrive(googleToken, file.fileId); } catch { /* ignore */ }
    } else if (action === 'archive' && googleToken) {
      try {
        await renameFolderInDrive(googleToken, file.fileId, `[Archived] ${file.name}`);
      } catch { /* ignore */ }
    }
    setAttachments(prev => prev.filter(f => f.fileId !== file.fileId));
  };

  return {
    attachedFiles,
    setAttachments,
    uploadingCount,
    removePrompt,
    setRemovePrompt,
    handleFileSelect,
    handleRemoveChip,
    confirmRemoveChip,
  };
}
