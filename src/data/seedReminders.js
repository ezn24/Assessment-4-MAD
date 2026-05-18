const now = new Date();

const addMinutes = (minutes) => {
  const value = new Date(now);
  value.setMinutes(value.getMinutes() + minutes);
  return value.toISOString();
};

export const seedReminders = [
  {
    id: "bring-key",
    title: "Bring Key",
    description: "Bring it before go out!!!!!",
    visualCue: "Key by the front door",
    icon: "key",
    scheduledAt: addMinutes(15),
    important: true,
    completed: false,
    imageUri: null,
    streak: 4
  },
  {
    id: "turn-off-stove",
    title: "Turn off stove",
    description: "Check the stove before leaving home",
    visualCue: "Stove knobs in off position",
    icon: "fire",
    scheduledAt: addMinutes(55),
    important: false,
    completed: false,
    imageUri: null,
    streak: 2
  },
  {
    id: "bring-jacket",
    title: "Bring jacket",
    description: "Jacket on the hallway hook",
    visualCue: "Jacket hanging near the door",
    icon: "tshirt-crew",
    scheduledAt: addMinutes(130),
    important: true,
    completed: false,
    imageUri: null,
    streak: 1
  }
];
