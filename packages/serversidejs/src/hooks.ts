export interface Hook {
  (req: Request, res: Response | null): Promise<Response | null> | Response | null;
}

class HooksManager {
  private hooks: Hook[] = [];
  private static instance: HooksManager;

  static getInstance() {
    if (!HooksManager.instance) {
      HooksManager.instance = new HooksManager();
    }
    return HooksManager.instance;
  }

  addHook(hook: Hook) {
    this.hooks.push(hook);
  }

  async handle(req: Request, res: Response | null): Promise<Response | null> {
    let currentResponse = res;

    for (const hook of this.hooks) {
      const hookResult = await hook(req, currentResponse);
      if (hookResult) {
        currentResponse = hookResult;
      }
    }

    return currentResponse;
  }
}

export const hooksManager = HooksManager.getInstance();

export function useHook(hook: Hook) {
  hooksManager.addHook(hook);
}

export async function handleHooks(req: Request, res: Response | null): Promise<Response | null> {
  return hooksManager.handle(req, res);
} 