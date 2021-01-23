const JET_CHANCE = 4/15; // 4 out of 15 chassis have jets standard
const MIN_ARMOR_FRACTION = 0.5;
const MIN_ARMOR_FRONT_BACK_RATIO = 1;
const MAX_ARMOR_FRONT_BACK_RATIO = 2.5;

// returns a fully specified random mech within the given limitations.
// TODO don't allow engines + jets to be more than total allowed mass
function rollMech(options) {
	let mech = {xl: true, endo: true, ferro: true, weapons: [], ammo: [],
		num_heat_sinks: 20};
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
		Math.max(criticals.double_heat_sink) + mech.jet_mass * mech.num_jets;

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
		mass += ferroArmorMass
	} else {
		console.error('std armor mass NYI'); // TODO
	}

	// weapons/ammo
	for (let i = 0; i < mech.weapons.length; i++) {
		mass += weapons[mech.weapons[i]].mass;
		mass += mech.weapons[i].ammo * mechlab.ammo_unit_mass;
	}
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
	// TODO weapons, ammo

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
				for (let k = 0; k < crit.crit[j]; k++) {
					part.push(name);
				}
				break;
			}
		}
	}
}

// randomly allocates weapons and ammo to the mech, including allocating
// criticals.
function rollWeapons(mech, require_energy_weapon) {
	// TODO
}
