import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import chat from "./chatSlice";

export const makeStore = () => configureStore({ reducer: { chat } });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

export const selectMessages = (s: RootState) => s.chat.messages;
export const selectIsBusy = (s: RootState) =>
  s.chat.messages.some((m) => m.role === "assistant" && m.status === "streaming");
