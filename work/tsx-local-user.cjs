const os = require('node:os');
const { syncBuiltinESMExports } = require('node:module');
const userInfo = os.userInfo;
os.userInfo = (...args) => {
  try { return userInfo(...args); }
  catch (error) {
    if (error.code !== 'ERR_SYSTEM_ERROR' || error.info?.syscall !== 'uv_os_get_passwd') throw error;
    return { username: 'hycon-demo-run', homedir: os.homedir(), shell: null, uid: -1, gid: -1 };
  }
};
syncBuiltinESMExports();
