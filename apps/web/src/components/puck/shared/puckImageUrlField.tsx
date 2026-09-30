import {Button, Input} from '@merlin/ui';
import type {CustomField} from '@puckeditor/core';
import {Loader2, Upload} from 'lucide-react';
import {useRef, useState} from 'react';
import {toast} from 'sonner';

import {useConfig} from '../../../lib/hooks/useConfig';
import {uploadProjectFile} from '../../../lib/uploadProjectFile';

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,image/avif';

function PuckImageUrlInput({value, onChange}: {value: string; onChange: (next: string) => void}) {
  const {data: config} = useConfig();
  const s3Enabled = config?.features.storage.s3Enabled === true;
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;

    try {
      setUploading(true);
      const uploaded = await uploadProjectFile(file, {systemFolder: 'quick-uploads'});
      if (!uploaded.publicUrl) {
        toast.error('Upload succeeded but no public URL was returned');
        return;
      }
      onChange(uploaded.publicUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Input value={value} onChange={e => onChange(e.target.value)} placeholder="https://" />
      {s3Enabled ? (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={IMAGE_ACCEPT}
            className="hidden"
            onChange={e => void handleFile(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload
          </Button>
        </>
      ) : null}
    </div>
  );
}

export function puckImageUrlField(label = 'Image URL'): CustomField<string> {
  return {
    type: 'custom',
    label,
    render: ({value, onChange}) => <PuckImageUrlInput value={value ?? ''} onChange={onChange} />,
  };
}
