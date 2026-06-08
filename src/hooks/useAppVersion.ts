import { useEffect, useState } from 'react';
import {
  APP_BUILD_VERSION,
  VERSION_POLL_INTERVAL_MS,
  isAppVersionUpdate,
  readRemoteAppVersion,
} from '../lib/appVersion';

export function useAppVersion() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkForUpdate = async () => {
      const remoteVersion = await readRemoteAppVersion();
      if (!mounted || !remoteVersion) return;

      if (isAppVersionUpdate(APP_BUILD_VERSION, remoteVersion)) {
        setUpdateAvailable(true);
      }
    };

    void checkForUpdate();
    const intervalId = window.setInterval(() => {
      void checkForUpdate();
    }, VERSION_POLL_INTERVAL_MS);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return {
    updateAvailable,
    reloadApp: () => window.location.reload(),
  };
}
