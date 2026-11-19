// Preloaded only by the offline verification harness, never by production.
globalThis.fetch=async()=>{throw new Error('Live network is forbidden in offline advisory tests. Supply a local mock.');};
