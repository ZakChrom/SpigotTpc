// TODO
const UserRole = {
  member: 0,
  guest: 1
}

roles = {};

defaultRole = UserRole.member;

function getRole(ws) {
    const {clientIDs} = require('./index')
    return roles[clientIDs()[ws] ?? "Unknown"] ?? defaultRole;
}

module.exports = {
    getRole: getRole,
    defaultRole: defaultRole,
    UserRole: UserRole,
    roles: () => roles
}