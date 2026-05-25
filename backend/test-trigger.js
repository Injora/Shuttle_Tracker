const dispatchManager = require('./src/services/dispatchManager');

(async () => {
    try {
        console.log("Triggering dispatch manually...");
        // Mock IO for the socket
        const mockIo = {
            emit: (event, data) => console.log("Emitted:", event, data)
        };
        const result = await dispatchManager.triggerDispatch("test_trigger", mockIo);
        console.log("Dispatch result:", result);
    } catch (err) {
        console.error("Error triggering dispatch:", err);
    }
    process.exit(0);
})();
