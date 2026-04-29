import { useEffect, useRef, useState } from 'react';
import { Paperclip, Upload, Trash2, Download, FileText, Image } from 'lucide-react';
import { attachmentsApi } from '@/lib/api';
import { Button } from './ui/button';
import { formatDate } from '@/lib/utils';

interface Attachment {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  mimeType?: string;
  createdAt: string;
  uploadedBy?: { id: string; displayName: string };
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ mimeType }: { mimeType?: string }) {
  if (mimeType?.startsWith('image/')) return <Image className="h-4 w-4 text-blue-500" />;
  return <FileText className="h-4 w-4 text-muted-foreground" />;
}

interface Props {
  taskId?: string;
  projectId?: string;
  currentUserId?: string;
}

export default function FileAttachments({ taskId, projectId, currentUserId }: Props) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const data = taskId
        ? await attachmentsApi.listForTask(taskId)
        : await attachmentsApi.listForProject(projectId!);
      setAttachments(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [taskId, projectId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = taskId
        ? await attachmentsApi.uploadToTask(taskId, file)
        : await attachmentsApi.uploadToProject(projectId!, file);
      if (result.id) setAttachments((prev) => [result, ...prev]);
    } catch (err: any) {
      alert(err.response?.data?.message ?? 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (att: Attachment) => {
    if (!confirm(`Delete "${att.fileName}"?`)) return;
    await attachmentsApi.delete(att.id);
    setAttachments((prev) => prev.filter((a) => a.id !== att.id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-medium">
          <Paperclip className="h-4 w-4" /> Attachments ({attachments.length})
        </h4>
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="mr-1 h-3 w-3" />
          {uploading ? 'Uploading…' : 'Attach File'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          accept="image/*,.pdf,.txt,.csv,.json,.doc,.docx,.xls,.xlsx,.zip"
        />
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground">No attachments yet.</p>
      ) : (
        <ul className="space-y-1">
          {attachments.map((att) => (
            <li key={att.id} className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
              <FileIcon mimeType={att.mimeType} />
              <div className="flex-1 min-w-0">
                <a
                  href={att.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium hover:underline truncate block"
                >
                  {att.fileName}
                </a>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(att.fileSize)} · {att.uploadedBy?.displayName} · {formatDate(att.createdAt)}
                </p>
              </div>
              <a
                href={att.fileUrl}
                download={att.fileName}
                className="text-muted-foreground hover:text-foreground"
                title="Download"
              >
                <Download className="h-4 w-4" />
              </a>
              <button
                onClick={() => handleDelete(att)}
                className="text-red-400 hover:text-red-600"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
