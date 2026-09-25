// Compatibility shim for stale clients requesting aiActionDispatcher-CPRX2UgJ.js
if (typeof window !== 'undefined') {
  setTimeout(() => {
    console.warn('[Forma] Stale aiActionDispatcher chunk requested. Auto-reloading page...');
    window.location.reload();
  }, 100);
}
export async function dispatchAiAction(intent, context, onProgress) {
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
  return {
    success: false,
    action: intent?.action || "watermark_remove",
    message: "🔄 Sitede yeni bir güncelleme yayınlandı. Sayfa otomatik olarak yenileniyor..."
  };
}
export function formatCandidateTitle(c) { return "Filigran / Damga"; }
export function formatCandidateDetails(c) { return "Sayfa öğesi"; }
export default { dispatchAiAction, formatCandidateTitle, formatCandidateDetails };
