import{createContext,useContext}from'react';
export const FirmContext=createContext(null);
export const useFirmContext=()=>useContext(FirmContext);
