const HEAD = 0;
const RIGHT_TORSO = 1, CENTER_TORSO = 2, LEFT_TORSO = 3;
const RIGHT_ARM = 4, LEFT_ARM = 5;
const RIGHT_LEG = 6, LEFT_LEG = 7;

// returns a byte array representing a MEK file for the given mech.
function writeMEK(mech) {
	let num_bytes = 344 + 8 * (mech.weapons.length + countAmmo(mech.weapons)) + 50;
	let array = new Uint8Array(num_bytes);

	// "header"
	array[0] = mech.chassis.max_mass;
	array[4] = mech.engine;
	array[8] = mech.num_jets;
	array[12] = mech.num_heat_sinks * (mech.double_heat_sinks ? 2 : 1);
	array[16] = mech.weapons.length;
	array[20] = countAmmo(mech.weapons);
	let offset = 24;

	// body sections
	for (let i = HEAD; i <= LEFT_LEG; i++) {
		setBodyPart(array.subarray(offset, offset + 40), mech, i);
		offset += 40;
	}

	// weapon list
	for (let i = 0; i < mech.weapons.length; i++) {
		let weapon = mech.weapons[i];
		setWeaponOrAmmo(array.subarray(offset, offset + 4), weapon, null);
		array[offset + 4] = 0xff;
		array[offset + 5] = 0xff;
		array[offset + 6] = 0xff;
		array[offset + 7] = 0xff;
		offset += 8;
	}

	// ammo list
	let ammo_counts = {};
	for (let i = 0; i < mech.weapons.length; i++) {
		let weapon = mech.weapons[i];
		for (let j = 0; j < weapon.ammo; j++) {
			setWeaponOrAmmo(array.subarray(offset, offset + 4), weapon, ammo_counts);
			setWeaponOrAmmo(array.subarray(offset + 4, offset + 8), weapon, null);
			offset += 8;
		}
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
		let id = mech.criticals[part][i];
		array[12 + i * 2] = id & 0xff;
		array[13 + i * 2] = id >> 8;
	}
	array[36] = mechlab.body_crits[part];
	array[38] = 1; // unknown
}

// fills a byte array with a weapon data structure.
function setWeaponOrAmmo(array, weapon, ammo_counts) {
	let id = criticals[weapon.weapon.name]['id'];
	let type_id = Math.floor(id / 50) * 50;
	if (ammo_counts == null) {
		id = type_id + weapon.number;
	} else {
		if (ammo_counts[type_id] == undefined) {
			ammo_counts[type_id] = 1;
		} else {
			ammo_counts[type_id]++;
		}
		id = 10000 + type_id + ammo_counts[type_id];
	}
	array[0] = id & 0xff;
	array[1] = id >> 8;
}

// counts the total number of ammo criticals.
function countAmmo(weapons) {
	let n = 0;
	for (let i = 0; i < weapons.length; i++) {
		n += weapons[i].ammo;
	}
	return n;
}
