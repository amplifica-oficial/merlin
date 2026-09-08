export async function uploadViaPresignedUrl(file: File, presignedUrl: string, contentType: string): Promise<void> {
  const res = await fetch(presignedUrl, {
    method: 'PUT',
    body: file,
    headers: {'Content-Type': contentType},
  });

  if (!res.ok) {
    throw new Error('Failed to upload file.');
  }
}
