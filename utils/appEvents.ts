type Listener = () => void;

const partyListeners: Listener[] = [];

export const onPartyUpdate = (cb: Listener) => {
  partyListeners.push(cb);
  return () => {
    const idx = partyListeners.indexOf(cb);
    if (idx >= 0) partyListeners.splice(idx, 1);
  };
};

export const emitPartyUpdate = () => {
  partyListeners.slice().forEach((cb) => {
    try {
      cb();
    } catch (e) {
      // ignore
    }
  });
};
