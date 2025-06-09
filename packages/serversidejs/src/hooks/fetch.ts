

export class FetchManager {
    private fetchHook: any = ({req}: {req: any}) => fetch(req);
    static instance: FetchManager;
    static getInstance() {
        if (!FetchManager.instance) {
            FetchManager.instance = new FetchManager();
        }
        return FetchManager.instance;
    }

    setFetchHook(fetchHook: any) {
        this.fetchHook = fetchHook;
    }

    handle({req}: {req: any}) {
        let request = null;
        return this.fetchHook({req});
    }
}

const fetchManager = FetchManager.getInstance();

export const fetch = ({req}: {req: any}) => fetchManager.handle({req});

