/** A rocket climbing towards the point where it bursts. */
export interface Rocket {
  x: number;
  y: number;
  vy: number;
  color: string;
}

/** One spark from a burst, fading out as it falls. */
export interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  /** Seconds left; it is drawn fainter as this runs out. */
  life: number;
  maxLife: number;
}

/** Everything in the sky, in canvas pixels, plus how long rockets keep launching. */
export interface Show {
  readonly width: number;
  readonly height: number;
  readonly colors: readonly string[];
  rockets: Rocket[];
  sparks: Spark[];
  /** Seconds of launching left; once it is 0 the show ends as the last sparks fade. */
  launching: number;
  /** Seconds until the next launch. */
  nextLaunch: number;
}

const GRAVITY = 220;
const SPARKS_PER_BURST = 90;

export function newShow(
  width: number,
  height: number,
  colors: readonly string[],
  durationSec = 5,
): Show {
  return { width, height, colors, rockets: [], sparks: [], launching: durationSec, nextLaunch: 0 };
}

/** The show has stopped launching and everything it launched has burnt out. */
export const showOver = (show: Show) =>
  show.launching <= 0 && show.rockets.length === 0 && show.sparks.length === 0;

/** Advances the show by `dt` seconds. `random` returns numbers in [0, 1). */
export function step(show: Show, dt: number, random: () => number = Math.random): void {
  show.launching = Math.max(0, show.launching - dt);
  show.nextLaunch -= dt;
  if (show.launching > 0 && show.nextLaunch <= 0) {
    show.nextLaunch = 0.15 + random() * 0.35;
    show.rockets.push({
      x: show.width * (0.15 + random() * 0.7),
      y: show.height,
      // Fast enough to climb to between a fifth and a half of the way down the screen.
      vy: -Math.sqrt(2 * GRAVITY * show.height * (0.5 + random() * 0.3)),
      color: show.colors[Math.floor(random() * show.colors.length)] ?? "white",
    });
  }

  const climbing: Rocket[] = [];
  for (const rocket of show.rockets) {
    rocket.vy += GRAVITY * dt;
    rocket.y += rocket.vy * dt;
    if (rocket.vy < 0) climbing.push(rocket);
    else burst(show, rocket, random);
  }
  show.rockets = climbing;

  show.sparks = show.sparks.filter((spark) => {
    spark.life -= dt;
    spark.vx *= 1 - 1.2 * dt;
    spark.vy = spark.vy * (1 - 1.2 * dt) + GRAVITY * 0.35 * dt;
    spark.x += spark.vx * dt;
    spark.y += spark.vy * dt;
    return spark.life > 0;
  });
}

/** Bursts `rocket` into a ring of sparks in its color. */
function burst(show: Show, rocket: Rocket, random: () => number): void {
  const speed = 160 + random() * 160;
  for (let i = 0; i < SPARKS_PER_BURST; i++) {
    const angle = (i / SPARKS_PER_BURST) * Math.PI * 2 + random() * 0.2;
    const v = speed * (0.6 + random() * 0.4);
    const life = 1.2 + random() * 0.8;
    show.sparks.push({
      x: rocket.x,
      y: rocket.y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      color: rocket.color,
      life,
      maxLife: life,
    });
  }
}

/** Draws the show, fading out the previous frames so moving sparks leave short trails. */
export function draw(ctx: CanvasRenderingContext2D, show: Show): void {
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "rgb(0 0 0 / 0.25)";
  ctx.fillRect(0, 0, show.width, show.height);
  ctx.globalCompositeOperation = "source-over";
  for (const rocket of show.rockets) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = rocket.color;
    ctx.fillRect(rocket.x - 1.5, rocket.y - 4, 3, 8);
  }
  for (const spark of show.sparks) {
    ctx.globalAlpha = Math.max(0, spark.life / spark.maxLife);
    ctx.fillStyle = spark.color;
    ctx.beginPath();
    ctx.arc(spark.x, spark.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
