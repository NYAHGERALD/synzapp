import { registerRootComponent } from 'expo';
// Imported here, before anything else, because a push arriving with the app
// shut starts a bare JavaScript context that runs this file and nothing of the
// app itself. The task has to be defined by the time that context is asked to
// handle the push, so it cannot be registered from inside a screen.
import './src/services/chatDeliveryReceiptTask';
import App from './App';

registerRootComponent(App);
