// Upstream model tests exercise the call path against loopback HTTP stubs.
// Refuse any non-loopback socket so those tests cannot reach a paid provider.
import net from 'node:net';
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function(...args) {
  const input = Array.isArray(args[0]) ? args[0][0] : args[0];
  const options = typeof input === 'object' && input !== null ? input : {};
  const host = options.host ?? (typeof args[1] === 'string' ? args[1] : 'localhost');
  const unix = typeof input === 'string' || options.path;
  if (!unix && !['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
    throw new Error(`External networking refused by isolated test harness: ${host}`);
  }
  return connect.apply(this, args);
};
