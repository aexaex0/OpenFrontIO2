// AlexFront: the orbital laser's sizes, shared by the engine (which fires
// it) and the client (which draws the aiming circles).

/**
 * Radius, in tiles, of the circle the 2nd and 3rd aim points must lie in,
 * measured from the 1st: halfway between the atom bomb's (30) and the
 * hydrogen bomb's (100) outer blast radius.
 */
export const ORBITAL_LASER_AREA_RADIUS = 65;
/** Radius of the beam itself, in tiles. */
export const ORBITAL_LASER_BEAM_RADIUS = 6;
/** Ticks between firing and the beam touching down (the charge-up). */
export const ORBITAL_LASER_CHARGE = 30;
/** Tiles the beam travels along its path per tick. */
export const ORBITAL_LASER_SPEED = 3;
/** How many points the player clicks. */
export const ORBITAL_LASER_POINTS = 3;
