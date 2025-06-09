
export interface FetchOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
}

export interface FetchHook {
    ({request, fetch}: {request: Request, fetch: any}): Promise<Response>;
}

export class FetchManager {
    private fetchHook: FetchHook = ({request, fetch}) => fetch(request);
    static instance: FetchManager;
    static getInstance() {
        if (!FetchManager.instance) {
            FetchManager.instance = new FetchManager();
        }
        return FetchManager.instance;
    }

    setFetchHook(fetchHook: FetchHook) {
        this.fetchHook = fetchHook;
    }

    handle(req: Request | string, options?: FetchOptions) {
        let request: Request = new Request("http://localhost:3000");
        if(!(req instanceof Request)) {
            request = new Request(req, options)
        } else {
            request = req;
        }
        
        return this.fetchHook({request, fetch: fetch});
    }
}

const fetchManager = FetchManager.getInstance();

export const fetchHandler = (req: Request | string, options?: FetchOptions) => fetchManager.handle(req, options);

