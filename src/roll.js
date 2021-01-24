const JET_CHANCE = 4/15; // 4 out of 15 chassis have jets standard
const MIN_ARMOR_FRACTION = 0.5;
const MIN_ARMOR_FRONT_BACK_RATIO = 1;
const MAX_ARMOR_FRONT_BACK_RATIO = 2.5;

// returns a fully specified random mech within the given limitations.
// TODO don't allow engines + jets to be more than total allowed mass
function rollMech(options) {
	let mech = {
		xl: true,
		double_heat_sinks: true,
		endo: true,
		ferro: true,
		num_heat_sinks: mechlab.minimum_heat_sinks,
		weapons: [],
	};
	mech.chassis = rollChassis(options.min_mass, options.max_mass);
	if (mech.chassis === undefined) {
		console.error('invalid mass restrictions');
	}
	mech.engine = rollEngine(mech.chassis);
	if (options.always_max_jets) {
		mech.num_jets = mech.engine;
	} else {
		mech.num_jets = rollJets(mech.engine);
	}
	rollArmor(mech);
	allocateCriticals(mech);
	rollWeapons(mech, options.require_energy_weapon);
	mech.variant_name = 'mekgen test';
	return mech;
}

// linear distribution within tonnage constraint.
function rollChassis(min_mass, max_mass) {
	// lazy code for no infinite loops
	for (let i = 0; i < 100; i++) {
		let index = Math.floor(Math.random() * chassis.length);
		let mass = chassis[index].max_mass;
		if (mass >= min_mass && mass <= max_mass) {
			return chassis[index];
		}
	}
}

// linear distribution among the chassis' n/2 fastest engines.
function rollEngine(chassis) {
	let n = chassis.engine_mass.length;
	return Math.ceil(n/2) + Math.floor(Math.random() * n/2);
}

// rolls the number of jets a mech will have.
function rollJets(engine) {
	if (Math.random() < JET_CHANCE) {
		return 1 + Math.floor(Math.random() * engine);
	}
	return 0;
}

// rolls the amount of armor a mech will have.
// TODO: what happens if free_mass and MIN_ARMOR_FRACTION are unsatisfiable?
function rollArmor(mech) {
	// determine quantity of armor
	let free_mass = mechFreeMass(mech);
	let total_max_armor = sum(mech.chassis.max_armor);
	let fraction = MIN_ARMOR_FRACTION + Math.random() * (1 - MIN_ARMOR_FRACTION);
	if (ferroArmorMass(total_max_armor * fraction) > free_mass) {
		fraction = free_mass / ferroArmorMass(total_max_armor * fraction);
	}

	// determine distribution of armor
	let ratio = MIN_ARMOR_FRONT_BACK_RATIO +
		Math.random() * (MAX_ARMOR_FRONT_BACK_RATIO - MIN_ARMOR_FRONT_BACK_RATIO);
	mech.front_armor = [0, 0, 0, 0, 0, 0, 0, 0];
	mech.rear_armor = [0, 0, 0, 0, 0, 0, 0, 0];
	for (let i = 0; i < mech.front_armor.length; i++) {
		if (i == RIGHT_TORSO || i == CENTER_TORSO || i == LEFT_TORSO) {
			mech.front_armor[i] = Math.floor(mech.chassis.max_armor[i] *
				fraction / (1 + ratio) * ratio);
			mech.rear_armor[i] = Math.floor(mech.chassis.max_armor[i] *
				fraction / (1 + ratio));
		} else {
			mech.front_armor[i] = Math.floor(mech.chassis.max_armor[i] * fraction);
		}
	}
	mech.total_armor_units = sum(mech.front_armor) + sum(mech.rear_armor);
}

// returns the sum of an array of numbers.
function sum(array) {
	let x = 0;
	for (let i = 0; i < array.length; i++) {
		x += array[i];
	}
	return x;
}

// returns the mass required for a number of armor units, using ferro-f armor.
function ferroArmorMass(units) {
	for (let i = 0; i < mechlab.ferro_armor.length; i++) {
		if (mechlab.ferro_armor[i] >= units) {
			return i * mechlab.armor_unit_mass;
		}
	}
	// return undefined for impossible values
}

// returns the amount of unused mass.
function mechFreeMass(mech) {
	return mech.chassis.max_mass - mechUsedMass(mech);
}

// returns the amount of used mass.
function mechUsedMass(mech) {
	let mass = mech.chassis.gyro_mass[mech.engine] + mechlab.cockpit_mass +
		arrayMax(criticals.double_heat_sink.crit) +
		mech.chassis.jet_mass * mech.num_jets;

	// engine
	if (mech.xl) {
		mass += mech.chassis.engine_mass[mech.engine] * mechlab.xl_mult;
	} else {
		mass += mech.chassis.engine_mass[mech.engine];
	}

	// internal
	if (mech.endo) {
		mass += mech.chassis.max_mass * mechlab.internal_mult * mechlab.endo_mult;
	} else {
		mass += mech.chassis.max_mass * mechlab.internal_mult;
	}

	// armor
	if (mech.ferro) {
		mass += ferroArmorMass(mech.total_armor_units)
	} else {
		console.error('std armor mass NYI'); // TODO
	}

	// weapons/ammo
	for (let i = 0; i < mech.weapons.length; i++) {
		mass += mech.weapons[i].weapon.mass +
			mech.weapons[i].ammo * mechlab.ammo_unit_mass;
	}

	return mass;
}

// returns the largest value in the array.
function arrayMax(array) {
	let x = array[0];
	for (let i = 1; i < array.length; i++) {
		if (array[i] > x) {
			x = array[i];
		}
	}
	return x;
}

// returns the number of unused critical slots.
function mechFreeCriticals(mech) {
	let n = 0;
	for (let i = 0; i < mech.criticals.length; i++) {
		n += mechlab.body_crits[i] - mech.criticals[i].length;
	}
	return n;
}

// (re)allocates all a mech's criticals.
function allocateCriticals(mech) {
	// init crits list if necessary
	mech.criticals = [[], [], [], [], [], [], [], []]

	// accumulate required criticals
	let required_crits = ['life_support', 'sensors', 'cockpit', 'center_engine', 'gyro',
		'right_shoulder', 'left_shoulder', 'right_upper_arm_actuator',
		'left_upper_arm_actuator', 'right_hip', 'left_hip', 'right_upper_leg_actuator',
		'left_upper_leg_actuator', 'right_foot_actuator', 'left_foot_actuator'];
	if (mech.chassis.lower_leg_actuator) {
		required_crits.push('left_lower_leg_actuator', 'right_lower_leg_actuator');
	}
	if (mech.xl) {
		required_crits.push('right_xl_engine', 'left_xl_engine');
	}
	for (let i = mech.chassis.max_mass * mech.engine;
		i <= mech.num_heat_sinks * mechlab.engine_rating_per_heat_sink;
		i += mechlab.engine_rating_per_heat_sink) {
		required_crits.push('double_heat_sink');
	}
	if (mech.endo) {
		for (let i = 0; i < mechlab.endo_crit; i++) {
			required_crits.push('endo_steel');
		}
	}
	if (mech.ferro) {
		for (let i = 0; i < mechlab.ferro_crit; i++) {
			required_crits.push('ferro_fibrous');
		}
	}
	for (let i = 0; i < mech.num_jets; i++) {
		required_crits.push('jump_jet');
	}
	for (let i = 0; i < mech.weapons.length; i++) {
		let weapon = mech.weapons[i];
		required_crits.push(weapon.weapon.name);
		for (let j = 0; j < weapon.ammo; j++) {
			required_crits.push('ammo_' + weapon.weapon.name);
		}
	}

	// count the number of instances of non-identical items
	let counts = {};

	// allocate criticals
	// TODO: what happens if something doesn't fit?
	for (let i = 0; i < required_crits.length; i++) {
		let name = required_crits[i];
		let crit = criticals[name];
		let start = 0, end = mech.criticals.length, step = 1;
		if (name == 'jump_jet') {
			// prefer leg allocation for jump jets
			start = mech.criticals.length - 1, end = -1, step = -1;
		}
		for (let j = start; j != end; j += step) {
			let part = mech.criticals[j];
			if (crit.crit[j] > 0 &&
				mechlab.body_crits[j] - part.length >= crit.crit[j]) {
				let type_id = Math.floor(crit.id / 50) * 50;
				let id = type_id;
				if (crit.id % 50 != 0) {
					if (counts[type_id] == undefined) {
						counts[type_id] = 1;
					} else {
						counts[type_id]++;
					}
					id = type_id + counts[type_id];
				}
				for (let k = 0; k < crit.crit[j]; k++) {
					part.push(id);
				}
				break;
			}
		}
	}
}

// randomly allocates weapons and ammo to the mech, including allocating
// criticals.
function rollWeapons(mech, require_energy_weapon) {
	let counts = {};
	while (mech.weapons.length < mechlab.max_weapons) {
		let free_crit = mechFreeCriticals(mech);
		let free_mass = mechFreeMass(mech);
		if (free_crit == 0 || free_mass < 0.5) {
			break;
		}
		for (let tries = 0; tries < 10; tries++) {
			let weapon = randomChoice(weapons);
			let mass = weapon.mass, crit = weapon.crit;
			if (weapon.ammo != 0) {
				mass += mechlab.ammo_unit_mass;
				crit += mechlab.ammo_crit;
			}
			if (mass > free_mass || crit > free_crit) {
				continue;
			}

			// found a weapon that fits
			if (counts[weapon.name] == undefined) {
				counts[weapon.name] = 1;
			} else {
				counts[weapon.name]++;
			}
			mech.weapons.push({
				weapon: weapon,
				number: counts[weapon.name],
				ammo: weapon.ammo != 0 ? 1 : 0,
			})
			allocateCriticals(mech);
			break;
		}
	}
}

// returns a random element from an array.
function randomChoice(array) {
	let i = Math.floor(Math.random() * array.length);
	return array[i];
}
