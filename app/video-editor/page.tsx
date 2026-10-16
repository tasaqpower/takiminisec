import { VideoEditorWorkspace } from '@/features/video-editor/components/VideoEditorWorkspace';
import { VideoEditorErrorBoundary } from '@/features/video-editor/components/VideoEditorErrorBoundary';

export default function VideoEditorPage() {
  return (
    <VideoEditorErrorBoundary>
      <VideoEditorWorkspace />
    </VideoEditorErrorBoundary>
  );
}
