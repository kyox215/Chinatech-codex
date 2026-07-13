export function getStoreOutputDraftProjectionCopy(savedReady: boolean, draftReady: boolean) {
  if (!savedReady && draftReady) {
    return "当前客户输出仍然阻断；保存这份草稿后预计解除阻断。";
  }
  if (savedReady && !draftReady) {
    return "当前客户输出仍可使用；保存这份草稿后将阻断客户消息、打印和票据。";
  }
  return savedReady
    ? "当前客户输出已就绪；草稿尚未保存，实际使用的仍是服务器版本。"
    : "当前客户输出仍然阻断；草稿尚未保存，实际缺失状态没有变化。";
}
