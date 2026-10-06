import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { Transaction } from '../../shared/domain';

type EntryType = Extract<Transaction['type'], 'expense' | 'income'>;
type CaptureFlow = {
  sheetOpen: boolean;
  choosingType: boolean;
  entryType: EntryType | null;
  open: () => void;
  close: () => void;
  chooseType: (type?: EntryType) => void;
  closeEntry: () => void;
};

const CaptureFlowContext = createContext<CaptureFlow | null>(null);

export function CaptureFlowProvider({ children }: { children: ReactNode }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [choosingType, setChoosingType] = useState(false);
  const [entryType, setEntryType] = useState<EntryType | null>(null);

  function open() {
    setChoosingType(false);
    setSheetOpen(true);
  }

  function close() {
    setSheetOpen(false);
    setChoosingType(false);
  }

  function chooseType(type?: EntryType) {
    if (!type) {
      setChoosingType(true);
      return;
    }
    close();
    setEntryType(type);
  }

  function closeEntry() {
    setEntryType(null);
  }

  return (
    <CaptureFlowContext.Provider
      value={{ sheetOpen, choosingType, entryType, open, close, chooseType, closeEntry }}
    >
      {children}
    </CaptureFlowContext.Provider>
  );
}

export function useCaptureFlow() {
  const value = useContext(CaptureFlowContext);
  if (!value) throw new Error('CaptureFlowProvider ausente.');
  return value;
}
