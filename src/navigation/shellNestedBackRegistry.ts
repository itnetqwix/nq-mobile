export type ShellNestedBackHandler = {
  canGoBack: () => boolean;
  goBack: () => void;
};

const handlerStack: ShellNestedBackHandler[] = [];

/** Register an inner back target (wallet stack, etc.). Deepest handler wins. */
export function registerShellNestedBackHandler(handler: ShellNestedBackHandler): () => void {
  handlerStack.push(handler);
  return () => {
    const index = handlerStack.indexOf(handler);
    if (index >= 0) handlerStack.splice(index, 1);
  };
}

/** Pop the innermost frame that can go back. */
export function tryShellNestedBack(): boolean {
  for (let i = handlerStack.length - 1; i >= 0; i -= 1) {
    const handler = handlerStack[i];
    if (handler.canGoBack()) {
      handler.goBack();
      return true;
    }
  }
  return false;
}

export function clearShellNestedBackHandlers(): void {
  handlerStack.length = 0;
}
