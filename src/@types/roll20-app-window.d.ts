export interface Roll20AppWindow extends Window {
  currentPlayer: {
    save: ({ globalvolume }) => void;
  };
}
