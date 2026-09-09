import { configureStore, Middleware } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import videoReducer from './videoSlice';
import stateMachineReducer, { recordReduxAction } from './stateMachineSlice';
import errorsReducer from './errorsSlice';
import networkReducer from './networkSlice';

// Custom Middleware: Audit and record EVERY dispatched Redux action into the State Machine history
const reduxActionAuditMiddleware: Middleware = (api) => (next) => (action: any) => {
  const result = next(action);

  // Avoid infinite loops by ignoring recordReduxAction and internal redux init actions
  if (
    action &&
    typeof action === 'object' &&
    action.type &&
    action.type !== 'stateMachine/recordReduxAction' &&
    !action.type.startsWith('@@redux')
  ) {
    try {
      // Dispatch audit trail entry
      api.dispatch(
        recordReduxAction({
          id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          type: action.type,
          payload: action.payload,
          timestamp: Date.now(),
        })
      );
    } catch {
      // Safe fallback
    }
  }

  return result;
};

export const store = configureStore({
  reducer: {
    video: videoReducer,
    stateMachine: stateMachineReducer,
    errors: errorsReducer,
    network: networkReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false, // Allow Error objects, Response payloads, and raw traces
    }).concat(reduxActionAuditMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

