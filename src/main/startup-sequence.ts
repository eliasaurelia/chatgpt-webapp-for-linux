export interface StartupSequenceOptions {
  startBlocker: () => Promise<void>;
  createMainWindow: () => Promise<void>;
  installMenu: () => void;
  onBlockerError: (error: unknown) => void;
}

export async function runStartupSequence(options: StartupSequenceOptions): Promise<void> {
  const blockerReady = options.startBlocker().catch(options.onBlockerError);

  await options.createMainWindow();
  options.installMenu();

  void blockerReady;
}
