export interface AiRequestQueueItem {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  addedAt: number;
  startedAt?: number;
  completedAt?: number;
}

type AiQueueTask = () => Promise<void>;

interface AiQueueEntry extends AiRequestQueueItem {
  task: AiQueueTask;
}

class AiRequestQueue {
  private static instance: AiRequestQueue;
  private entries: AiQueueEntry[] = [];
  private runningCount = 0;
  private maxConcurrent = 1;
  private listeners: ((items: AiRequestQueueItem[]) => void)[] = [];

  static getInstance(): AiRequestQueue {
    if (!AiRequestQueue.instance) {
      AiRequestQueue.instance = new AiRequestQueue();
    }
    return AiRequestQueue.instance;
  }

  setMaxConcurrent(n: number): void {
    this.maxConcurrent = Math.max(1, Math.min(10, n));
    this.processNext();
  }

  enqueue(label: string, task: AiQueueTask): string {
    const id = crypto.randomUUID();
    this.entries.push({ id, label, status: 'pending', addedAt: Date.now(), task });
    this.notify();
    this.processNext();
    return id;
  }

  clearCompleted(): void {
    this.entries = this.entries.filter(e => e.status === 'pending' || e.status === 'running');
    this.notify();
  }

  getItems(): AiRequestQueueItem[] {
    return this.entries.map(({ task: _task, ...rest }) => rest);
  }

  subscribe(listener: (items: AiRequestQueueItem[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private async processNext(): Promise<void> {
    if (this.runningCount >= this.maxConcurrent) return;
    const next = this.entries.find(e => e.status === 'pending');
    if (!next) return;

    this.runningCount++;
    next.status = 'running';
    next.startedAt = Date.now();
    this.notify();

    try {
      await next.task();
      next.status = 'completed';
    } catch (err: unknown) {
      next.status = 'failed';
      next.error = err instanceof Error ? err.message : String(err);
    } finally {
      next.completedAt = Date.now();
      this.runningCount--;
      this.notify();
      this.processNext();
    }
  }

  private notify(): void {
    const snapshot = this.getItems();
    this.listeners.forEach(l => l(snapshot));
  }
}

export const aiRequestQueue = AiRequestQueue.getInstance();
