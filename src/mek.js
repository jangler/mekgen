const HEAD = 0;
const RIGHT_TORSO = 1, CENTER_TORSO = 2, LEFT_TORSO = 3;
const RIGHT_ARM = 4, LEFT_ARM = 5;
const RIGHT_LEG = 6, LEFT_LEG = 7;

// returns a byte array representing a MEK file for the given mech.
function writeMEK(mech) {
	let num_bytes = 344 + 8 * (mech.weapons.length + mech.ammo.length) + 50;
	let array = new Uint8Array(num_bytes);

	// "header"
	array[0] = mech.chassis.max_mass;
	array[4] = mech.engine;
	array[8] = mech.num_jets;
	array[12] = mech.num_heat_sinks;
	array[16] = mech.weapons.length;
	array[20] = mech.ammo.length;
	let offset = 24;

	// body sections
	for (let i = HEAD; i <= LEFT_LEG; i++) {
		setBodyPart(array.subarray(offset, offset + 40), mech, i);
		offset += 40;
	}

	// weapon/ammo list
	for (let i = 0; i < mech.weapons.length; i++) {
		let weapon = mech.weapons[i];
		setWeaponOrAmmo(array.subarray(offset, offset + 4), weapon, false);
		array[offset + 4] = 0xff;
		array[offset + 5] = 0xff;
		for (let j = 0; j < weapon.ammo; j++) {
			setWeaponOrAmmo(array.subarray(offset, offset + 4), weapon, true);
			setWeaponOrAmmo(array.subarray(offset + 4, offset + 8), weapon, false);
		}
		offset += 8;
	}

	// name/comment
	for (let i = 0; i < mech.variant_name.length; i++) {
		array[offset + i] = mech.variant_name.charCodeAt(i);
	}

	return array;
}

// fills a byte array with a body part data structure.
function setBodyPart(array, mech, part) {
	array[0] = mech.front_armor[part];
	array[4] = mech.rear_armor[part];
	array[8] = mekfmt.part_type[part];
	for (let i = 0; i < mech.criticals[part].length; i++) {
		let thing = mech.criticals[part][i];
		let id = criticals[thing]['id'];
		array[12 + i * 2] = id & 0xff;
		array[13 + i * 2] = id >> 8;
	}
	array[36] = mechlab.body_crits[part];
	array[38] = 1; // unknown
}

// fills a byte array with a weapon data structure.
// TODO handle ammo IDs correctly
function setWeaponOrAmmo(array, item, is_ammo) {
	let id = criticals[item.name]['id'];
	if (is_ammo) {
		id += 10000;
	}
	if (item.number != 0) {
		id += item.number - 1; // e.g. the "#1" in "ER PPC #1"
	}
	array[0] = id & 0xff;
	array[1] = id >> 8;
}
