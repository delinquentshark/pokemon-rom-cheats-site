/* Wishes of Tomorrow: every code this page shows, built in the browser.
   A line-for-line copy of tools/games/wishes-of-tomorrow/codes.py. `python tests.py jscheck` runs this file in Node
   and compares every code it can build (all species, natures, genders, TM/move pairs, party edits...) with codes.py,
   so the two can't drift apart. Needs assets/guide.js (G.par) loaded first. */
(function (root) {
  "use strict";
  const {patch} = root.G.par;
  const cat = (...parts) => [].concat(...parts);

  // Always shiny: CreateBoxMon's shiny decision + the ice-lab starters' own roll
  const SHINY = cat(patch(0x081B685A, 0x2301), patch(0x0823FF4E, 0x2401));

  // Wild encounters (CreateWildMon)
  const IV = patch(0x0823C076, 0x211F);
  const SPECIES = sp => cat(patch(0x0823C042, 0x46C0), patch(0x0823C12A, 0x4C01), patch(0x0823C12C, 0xE78B),
                            patch(0x0823C132, 0x0000), patch(0x0823C130, sp));
  const NATURE = n => cat(patch(0x0823C066, 0x2200 | n), patch(0x0823C068, 0x46C0), patch(0x0823C126, 0x2200 | n));
  const MALE = 0x00, FEMALE = 0xFE;
  const GENDER = g => cat(patch(0x0823C052, 0x2600 | g), patch(0x0823C054, 0x46C0), patch(0x081B3AF6, 0xD80A));

  // One-off (static) encounters (CreateScriptedWildMon)
  const IV_STATIC = patch(0x08200860, 0x211F);
  const NATURE_STATIC = n => patch(0x08200854, 0x2200 | n);
  const GENDER_STATIC = g => patch(0x08200858, 0x2100 | g);
  const SPECIES_STATIC = sp => cat(patch(0x0820082A, 0xB084), patch(0x0820082C, 0x4C00), patch(0x0820082E, 0xE001),
                                   patch(0x08200832, 0x0000), patch(0x08200834, 0x0015), patch(0x08200836, 0x000E),
                                   patch(0x08200830, sp));

  // Gifts (ScrCmd_createmon)
  const NATURE_GIFT = n => patch(0x0820105A, 0x2200 | n);
  const GENDER_GIFT = g => patch(0x08201058, 0x2100 | g);
  const IV_GIFT = cat(patch(0x08201114, 0x231F), patch(0x08201116, 0x8023), patch(0x08201118, 0x46C0));
  const SPECIES_GIFT = sp => cat(patch(0x08200D5E, 0x2400 | (sp >> 8)), patch(0x08200D60, 0x0224), patch(0x08200D62, 0x3400 | (sp & 0xFF)));

  // The three versions: "wild", "all" (wild + one-off) and "gift" (wild + one-off + gifts). Each includes the one before.
  const SCOPES = ["wild", "all", "gift"];
  const scoped = (wild, st, gift) => scope => cat(wild, scope !== "wild" ? st : [], scope === "gift" ? gift : []);
  const iv = scope => scoped(IV, IV_STATIC, IV_GIFT)(scope);
  const species = (sp, scope) => scoped(SPECIES(sp), SPECIES_STATIC(sp), SPECIES_GIFT(sp))(scope);
  const nature = (n, scope) => scoped(NATURE(n), NATURE_STATIC(n), NATURE_GIFT(n))(scope);
  const gender = (g, scope) => scoped(GENDER(g), GENDER_STATIC(g), GENDER_GIFT(g))(scope);

  // TMs and HMs: the TM -> move table, and "any Pokemon can learn it"
  const TM_TABLE = 0x086FB0EC, TM_FIRST_ITEM = 582;
  const tm = (item, move) => patch(TM_TABLE + 2 * (item - TM_FIRST_ITEM), move);
  const ANY_TM = patch(0x0819BA58, 0xE004);

  // Money, coins, Battle Points
  const MONEY = cat(patch(0x081897A0, 0x4818), patch(0x081897A2, 0x4770), patch(0x081897C8, 0x2001), patch(0x081897CA, 0x4770),
                    patch(0x081897EC, 0xE004), patch(0x08189810, 0xE7F2), patch(0x08189824, 0x2001), patch(0x08189826, 0x4770),
                    patch(0x08189850, 0x4770));
  const COINS = cat(patch(0x080EED58, 0x4824), patch(0x080EED5A, 0x4770), patch(0x080EEDA8, 0x4C10), patch(0x080EEDAC, 0xE011),
                    patch(0x080EEE0A, 0x2227), patch(0x080EEE0C, 0x0212), patch(0x080EEE0E, 0x320F));
  // PAR v3 RAM writes through a pointer: type 0x42 = 16-bit write at [pointer] + offset * 2
  const ramAddr = a => ((a >>> 4) & 0x00F00000) | (a & 0xFFFFF);
  const ptrWrite16 = (ptr, off, val) => [[(0x42000000 | ramAddr(ptr)) >>> 0, (((off >> 1) << 16) | (val & 0xFFFF)) >>> 0]];
  const BP = ptrWrite16(0x03005228, 0xEB8, 9999);
  // PC item storage: slot 1 of SaveBlock1 + 0x498 ({u16 item, u16 quantity})
  const pcItem = (item, qty = 999, slot = 1) => cat(ptrWrite16(0x0300522C, 0x498 + 4 * (slot - 1), item),
                                                    ptrWrite16(0x0300522C, 0x49A + 4 * (slot - 1), qty));

  // Experience (see codes.py for the capped rewrite of ApplyExperienceMultipliers)
  const EXP_LIMIT = 457151;
  const expCode = first => {
    const hw = [[0x5BE, 0x682F], [0x5C0, 0xE00B], [0x5C2, first], [0x5C4, 0x4903], [0x5C6, 0x4288], [0x5C8, 0xD900],
                [0x5CA, 0x1C08], [0x5CC, 0x6028], [0x5CE, 0xE025], [0x5D0, 0x46C0], [0x5D2, 0x46C0],
                [0x5D4, EXP_LIMIT & 0xFFFF], [0x5D6, EXP_LIMIT >>> 16], [0x5D8, 0x46C0], [0x61A, 0xE7D2]];
    return cat(...hw.map(([a, h]) => patch(0x080AF000 + a, h)));
  };
  const exp = mult => mult === "max" ? expCode(0x4804) : expCode({2: 1, 4: 2, 8: 3}[mult] << 6);

  // Eggs
  const EGG_FAST = patch(0x08102C08, 0x2B00);
  const EGG_INSTANT = cat(EGG_FAST, patch(0x08102C50, 0x2300), patch(0x08102C54, 0xE000));
  const eggs = speed => speed === "fast" ? EGG_FAST : EGG_INSTANT;

  // No random encounters
  const NO_ENCOUNTERS = cat(patch(0x0823BB04, 0x2000), patch(0x0823BB06, 0x4770));

  // Catch on the first ball: Cmd_handleballthrow's "odds above 254 -> caught" bhi at 0x080AD120 becomes b
  const ALWAYS_CATCH = patch(0x080AD120, 0xE01B);

  // Ability of new Pokemon: 0 first, 1 second, 2 hidden
  const ABILITY_BYTE = 0x09FFFF00;
  const ability = n => cat(...[0x9B17, 0xAA07, 0x2B00, 0xD100, 0x4A1D, 0x2137, 0x0020, 0x46C0, 0x46C0].map((h, i) => patch(0x081B6924 + 2 * i, h)),
                           patch(0x081B69A4, ABILITY_BYTE & 0xFFFF), patch(0x081B69A6, ABILITY_BYTE >>> 16), patch(ABILITY_BYTE, n));

  // Party editor: the routine from asm/party_editor.s, then its table (species u16, slot, (field, value) pairs, 0), then
  // the Start menu's POKeMON entry pointed at the routine. The routine changes nothing unless the Pokemon in that slot is
  // that species (and not an Egg).
  const EDITOR_BASE = 0x09FF8000, START_MENU_POKEMON = 0x08CF56B4;
  const EDITOR_HEX = "30b51aa5a87864214843134c241820001221124b00f01ef82988884215d1200036210e4b00f016f800280ed103352978002906d020006a1c" +
                     "094b00f00bf80235f5e72000074b00f005f830bc08bc9e46054b184718470000b81e03021d511b088d641b0815791b0835092108";
  const EDITOR_BYTES = EDITOR_HEX.match(/../g).map(h => parseInt(h, 16));
  const F_EV = [0x21, 0x22, 0x23, 0x24, 0x25, 0x26], F_IV = [0x30, 0x31, 0x32, 0x33, 0x34, 0x35], F_ABILITY = 0x37, F_BALL = 0x2F,
        F_NATURE = 0x0C, F_SHINY = 0x0B, F_FRIENDSHIP = 0x27;
  const BALLS = ["Strange Ball", "Poké Ball", "Great Ball", "Ultra Ball", "Master Ball", "Premier Ball", "Heal Ball", "Net Ball",
                 "Nest Ball", "Dive Ball", "Dusk Ball", "Timer Ball", "Quick Ball", "Repeat Ball", "Luxury Ball", "Level Ball",
                 "Lure Ball", "Moon Ball", "Friend Ball", "Love Ball", "Fast Ball", "Heavy Ball", "Dream Ball", "Safari Ball",
                 "Sport Ball", "Park Ball", "Beast Ball", "Cherish Ball"];   // index = the game's ball ID
  // slot 0-5; species: the species ID of the Pokemon in that slot; ivs / evs: six numbers (HP, Atk, Def, Speed, Sp. Atk,
  // Sp. Def) or null; ability 0-2; ball 0-27; nature 0-24; shiny true/false; friendship 0-255; null leaves a field alone
  function partyEdit(slot, species, {ivs = null, evs = null, ability = null, ball = null, nature = null, shiny = null,
                                     friendship = null} = {}) {
    const fields = [];
    if (ivs) F_IV.forEach((f, i) => fields.push(f, ivs[i]));
    if (evs) F_EV.forEach((f, i) => fields.push(f, evs[i]));
    if (ability !== null) fields.push(F_ABILITY, ability);
    if (ball !== null) fields.push(F_BALL, ball);
    if (nature !== null) fields.push(F_NATURE, nature);
    if (shiny !== null) fields.push(F_SHINY, shiny ? 1 : 0);
    if (friendship !== null) fields.push(F_FRIENDSHIP, friendship);
    const body = [...EDITOR_BYTES, species & 0xFF, species >> 8, slot, ...fields, 0];
    if (body.length % 2) body.push(0xFF);
    const out = [];
    for (let i = 0; i < body.length; i += 2) out.push(...patch(EDITOR_BASE + i, body[i] | body[i + 1] << 8));
    return cat(out, patch(START_MENU_POKEMON, (EDITOR_BASE | 1) & 0xFFFF), patch(START_MENU_POKEMON + 2, EDITOR_BASE >>> 16));
  }

  root.CODES = {SHINY, SCOPES, iv, species, nature, gender, MALE, FEMALE, tm, ANY_TM, MONEY, COINS, BP, pcItem,
                EXP_LIMIT, exp, eggs, NO_ENCOUNTERS, ALWAYS_CATCH, ability, partyEdit, BALLS};
})(typeof globalThis !== "undefined" ? globalThis : this);
