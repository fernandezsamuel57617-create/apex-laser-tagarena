# Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
- `/userProfiles/{userId}` stores zero PII (no emails, phones, or addresses). Verified users (`request.auth.token.email_verified == true`) may `get` and `list` profiles for the Friends List and online status display, while writes are strictly limited to the owner (`request.auth.uid == userId`).
- Document IDs (`userId`, `inviteId`) must match `^[a-zA-Z0-9_-]+$` and be <= 128 chars.
- `uid` is immutable and must equal `request.auth.uid`.
- `playerName` is 1..18 chars; `gender` is `'male'` or `'female'`; `country` matches `^[A-Z]{2}$`.
- `coins` is `0..1000000`, capped at `<= 250` on creation and `<= existing + 250` per match reward update.
- `ownedOutfits` (`1..10`), `ownedWeapons` (`1..11`), `ownedKnives` (`1..5`), and `ownedWeaponSkins` (`1..6`) contain only allowlisted IDs; `equippedOutfit` must exist in `ownedOutfits`, `equippedWeapon`/`equippedSidearm` must exist in `ownedWeapons`, `equippedKnife` must exist in `ownedKnives`, and `equippedWeaponSkin` must exist in `ownedWeaponSkins`.
- `onlineStatus` must be `'online' | 'in_match' | 'offline'`; `currentRoomCode` matches `^[A-Z0-9]{1,16}$`; `lastSeenAt` equals `request.time`.
- Daily mission fields (`dailyMissionsDate` `^[0-9]{4}-[0-9]{2}-[0-9]{2}$`, `dailyElims` `0..500`, `dailyWins` `0..100`, `dailyMatches` `0..200`, `dailyBestStreak` `0..100`, `dailyClaimedIds` `<= 4` allowlisted IDs) are validated on every write; claiming a mission reward increases `coins` by `<= 120` and appends strictly 1 new claimed mission ID for the current day.
- `/roomInvites/{inviteId}` requires `fromUid == request.auth.uid` on create, `toUid != fromUid`, `status == 'pending'`, `exists(/userProfiles/$(toUid))`, and valid `roomCode` (`^[A-Z0-9]{4,10}$`). Only sender or recipient can `get`, `list`, or `delete`; only the recipient can transition `status` from `'pending'` to `'accepted'` or `'declined'` (terminal state lock).

## 2. Dirty Dozen Adversarial Payloads
1. Unauthenticated `get` or `list` on `/userProfiles` -> `PERMISSION_DENIED`.
2. Authenticated userB attempting to update `/userProfiles/userA` -> `PERMISSION_DENIED`.
3. Unverified email user creating `/userProfiles/userA` or `/roomInvites/inv1` -> `PERMISSION_DENIED`.
4. UserA creating `/userProfiles/userA` with shadow field `isAdmin: true` -> `PERMISSION_DENIED`.
5. UserA updating `/userProfiles/userA` attempting to mint `coins: 999999` -> `PERMISSION_DENIED`.
6. UserA updating `/userProfiles/userA` equipping `'void_prism'` weapon skin without owning it in `ownedWeaponSkins` -> `PERMISSION_DENIED`.
7. UserA creating `/userProfiles/userA` with invalid skin ID `'hacked_gun'` inside `ownedWeaponSkins` -> `PERMISSION_DENIED`.
8. UserA updating `/userProfiles/userA` changing immutable `uid` or `createdAt` -> `PERMISSION_DENIED`.
9. UserA creating a `roomInvite` with `fromUid: "userB"` (spoofed sender) -> `PERMISSION_DENIED`.
10. UserA creating a `roomInvite` with `status: "accepted"` or non-existent `toUid` -> `PERMISSION_DENIED`.
11. UserC attempting to read or list a `roomInvite` between UserA and UserB -> `PERMISSION_DENIED`.
12. UserB attempting to update an already `'accepted'` `roomInvite` back to `'pending'` -> `PERMISSION_DENIED`.
