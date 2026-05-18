jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn()
}));
