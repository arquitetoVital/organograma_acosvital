import { createContext, useContext } from 'react';

export type FsMode = 'none' | 'tv' | 'clean';

export const FsContext = createContext<FsMode>('none');
export const useFsMode = () => useContext(FsContext);
