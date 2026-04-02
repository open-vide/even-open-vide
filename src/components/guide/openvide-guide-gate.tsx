import { useState, useEffect } from 'react';
import { Dialog } from 'even-toolkit/web';
import { GUIDE_STORAGE_KEY } from '@/lib/app-meta';
import { UNTITLED_DIALOG_CLASS } from '@/lib/dialog';
import { storageSetRaw, storageGetRaw } from 'even-toolkit/storage';
import { OpenVideGuide } from './openvide-guide';

export function OpenVideGuideGate() {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    storageGetRaw(GUIDE_STORAGE_KEY).then((val) => {
      if (val === '1') setOpen(false);
    }).catch(() => {});
  }, []);

  const handleClose = () => {
    try {
      storageSetRaw(GUIDE_STORAGE_KEY, '1');
    } catch {
      // Ignore storage failures and close the dialog anyway.
    }
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title=""
      className={`${UNTITLED_DIALOG_CLASS} max-w-[360px] h-[82vh] max-h-[82vh] overflow-hidden flex flex-col [&>div:last-child]:flex [&>div:last-child]:h-full [&>div:last-child]:min-h-0 [&>div:last-child]:overflow-hidden`}
    >
      <OpenVideGuide mode="dialog" onClose={handleClose} />
    </Dialog>
  );
}
