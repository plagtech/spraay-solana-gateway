import { Connection } from '@solana/web3.js';
import config from '../config.js';

let _connection = null;

export function getConnection() {
  if (!_connection) {
    _connection = new Connection(config.RPC_URL, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });
  }
  return _connection;
}
