const CATEGORY_RATES = {
  models: { dayMin: 400, dayMax: 2500, hourlyMin: 75, hourlyMax: 350 },
  talents: { dayMin: 350, dayMax: 1800, hourlyMin: 60, hourlyMax: 280 },
  photographers: { dayMin: 800, dayMax: 5000, hourlyMin: 120, hourlyMax: 600 },
  videographers: { dayMin: 900, dayMax: 6000, hourlyMin: 130, hourlyMax: 650 },
  directors: { dayMin: 1200, dayMax: 8000, hourlyMin: 150, hourlyMax: 800 },
  'creative-directors': { dayMin: 1000, dayMax: 7000, hourlyMin: 140, hourlyMax: 750 },
  'art-directors': { dayMin: 900, dayMax: 5500, hourlyMin: 130, hourlyMax: 550 },
  'makeup-artists': { dayMin: 350, dayMax: 2200, hourlyMin: 70, hourlyMax: 320 },
  'hair-stylists': { dayMin: 300, dayMax: 1800, hourlyMin: 65, hourlyMax: 280 },
  'makeup-hair': { dayMin: 500, dayMax: 2800, hourlyMin: 90, hourlyMax: 400 },
  stylists: { dayMin: 400, dayMax: 2500, hourlyMin: 75, hourlyMax: 350 },
  'content-creators': { dayMin: 300, dayMax: 2000, hourlyMin: 55, hourlyMax: 250 },
  default: { dayMin: 400, dayMax: 2500, hourlyMin: 75, hourlyMax: 350 },
};

const COMPLEXITY_MULTIPLIERS = {
  simple: 1,
  standard: 1.35,
  complex: 1.75,
  premium: 2.25,
};

const USAGE_MULTIPLIERS = {
  social: 1,
  web: 1.15,
  print: 1.4,
  campaign: 1.8,
  broadcast: 2.5,
};

async function estimatePrice(req, res, next) {
  try {
    const {
      categorySlug,
      durationHours,
      durationDays,
      complexity = 'standard',
      usage = 'social',
      teamSize = 1,
      location = 'local',
      deliverables = [],
    } = req.body;

    const rates = CATEGORY_RATES[categorySlug] || CATEGORY_RATES.default;
    const complexityMult = COMPLEXITY_MULTIPLIERS[complexity] || COMPLEXITY_MULTIPLIERS.standard;
    const usageMult = USAGE_MULTIPLIERS[usage] || 1;
    const teamMult = Math.max(1, Number(teamSize) || 1);
    const locationMult = location === 'international' ? 1.5 : location === 'travel' ? 1.25 : 1;
    const deliverableMult = 1 + (Array.isArray(deliverables) ? deliverables.length * 0.08 : 0);

    let baseMin;
    let baseMax;
    const days = Number(durationDays) || 0;
    const hours = Number(durationHours) || 0;

    if (days > 0) {
      baseMin = rates.dayMin * days;
      baseMax = rates.dayMax * days;
    } else if (hours > 0) {
      baseMin = rates.hourlyMin * hours;
      baseMax = rates.hourlyMax * hours;
    } else {
      baseMin = rates.dayMin;
      baseMax = rates.dayMax;
    }

    const multiplier = complexityMult * usageMult * teamMult * locationMult * deliverableMult;
    const min = Math.round(baseMin * multiplier);
    const max = Math.round(baseMax * multiplier);

    res.json({
      estimate: { min, max, currency: 'USD' },
      breakdown: {
        categorySlug: categorySlug || 'default',
        baseRange: { min: baseMin, max: baseMax },
        multipliers: {
          complexity: complexityMult,
          usage: usageMult,
          teamSize: teamMult,
          location: locationMult,
          deliverables: deliverableMult,
        },
      },
      disclaimer: 'Estimate only. Final pricing depends on scope, usage rights, and creative negotiation.',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { estimatePrice };
