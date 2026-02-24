/**
 * DocumentsList — Upload, list, and download meeting documents
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Upload, Loader2, Trash2, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthContext';
import { getDocuments, uploadDocument, deleteDocument, getDocumentUrl } from '@/lib/leadership/documentService';
import type { DocumentRow } from '@/types/leadershipModule';

interface DocumentsListProps {
  meetingId: string;
  canWrite: boolean;
  onUpdated: () => void;
}

const DocumentsList = ({ meetingId, canWrite, onUpdated }: DocumentsListProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDocuments(meetingId);
      setDocuments(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los documentos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [meetingId, toast]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      await uploadDocument(meetingId, file, user.id);
      await loadDocuments();
      toast({ title: 'Éxito', description: 'Documento subido correctamente' });
      onUpdated();
    } catch (error) {
      toast({
        title: 'Error',
        description: `Error al subir: ${error instanceof Error ? error.message : 'desconocido'}`,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (doc: DocumentRow) => {
    try {
      const url = await getDocumentUrl(doc.storage_path);
      window.open(url, '_blank');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo obtener el enlace de descarga',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (doc: DocumentRow) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este documento?')) return;

    try {
      await deleteDocument(doc.id, doc.storage_path);
      await loadDocuments();
      toast({ title: 'Éxito', description: 'Documento eliminado' });
      onUpdated();
    } catch (error) {
      toast({
        title: 'Error',
        description: `Error al eliminar: ${error instanceof Error ? error.message : 'desconocido'}`,
        variant: 'destructive',
      });
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('es-CL', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  return (
    <div className="space-y-4 p-4">
      {canWrite && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileUpload}
            accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-stone-900"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? 'Subiendo...' : 'Subir Documento'}
          </Button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Sin documentos</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.filename}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {doc.mime_type && (
                        <Badge variant="outline" className="text-xs">
                          {doc.mime_type.split('/')[1]?.toUpperCase()}
                        </Badge>
                      )}
                      {doc.file_size_bytes && (
                        <span className="text-xs text-muted-foreground">
                          {formatFileSize(doc.file_size_bytes)}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDate(doc.created_at)}
                      </span>
                    </div>
                    {doc.description && (
                      <p className="text-xs text-muted-foreground mt-1">{doc.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDownload(doc)}
                      className="h-8 w-8 p-0"
                      aria-label={`Descargar ${doc.filename}`}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {canWrite && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(doc)}
                        className="h-8 w-8 p-0"
                        aria-label={`Eliminar ${doc.filename}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentsList;
