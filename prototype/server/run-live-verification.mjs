import http from 'node:http';
import { localApi } from './api.mjs';

let handler;
localApi().configureServer({
  middlewares: {
    use(fn) {
      handler = fn;
    },
  },
});
const server = http.createServer(
  (req, res) =>
    void handler(req, res, () => {
      res.writeHead(404);
      res.end();
    }),
);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
process.env.BRANCH_TEST_URL = `http://127.0.0.1:${server.address().port}`;
try {
  await import('./live-check.mjs');
} finally {
  await new Promise((resolve) => server.close(resolve));
}
