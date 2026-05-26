import { usePlaybackStore, Track } from './playbackStore';

describe('PlaybackStore Divider Logic', () => {
  beforeEach(() => {
    usePlaybackStore.getState().clearQueue();
    usePlaybackStore.setState({ dividerIndex: -1 });
  });

  test('Adding tracks should respect dividerIndex (Task 1: Test 1)', () => {
    const store = usePlaybackStore.getState();
    const track1: Track = { id: '1', title: 'Manual 1', isAutoplay: false };
    const track2: Track = { id: '2', title: 'Autoplay 1', isAutoplay: true };
    
    // Add manual track
    store.addToQueue(track1);
    
    // Add autoplay track
    store.addToQueue(track2);
    
    // Add another manual track
    const track3: Track = { id: '3', title: 'Manual 2', isAutoplay: false };
    store.addToQueue(track3); // Should be inserted before autoplay
    
    const queue = usePlaybackStore.getState().queue;
    expect(queue.length).toBe(3);
    // Queue should be: [Manual 1, Manual 2, Autoplay 1]
    expect(queue[0].title).toBe('Manual 1');
    expect(queue[1].title).toBe('Manual 2');
    expect(queue[2].title).toBe('Autoplay 1');
    expect(usePlaybackStore.getState().dividerIndex).toBe(2);
  });

  test('Removing all manual tracks removes the divider (Task 1: Test 2)', () => {
    const store = usePlaybackStore.getState();
    store.addToQueue({ id: '1', title: 'Manual', isAutoplay: false });
    store.addToQueue({ id: '2', title: 'Autoplay', isAutoplay: true });
    
    store.removeFromQueue(0); // Remove manual
    expect(usePlaybackStore.getState().dividerIndex).toBe(-1);
    expect(usePlaybackStore.getState().queue[0].isAutoplay).toBe(true);
  });
  
  test('Shuffle only shuffles manual tracks (Task 1: Test 3)', () => {
    const store = usePlaybackStore.getState();
    store.addToQueue({ id: '1', title: 'M1', isAutoplay: false });
    store.addToQueue({ id: '2', title: 'M2', isAutoplay: false });
    store.addToQueue({ id: '3', title: 'A1', isAutoplay: true });
    
    store.toggleShuffle(); // Now shuffle enabled
    
    const queue = usePlaybackStore.getState().queue;
    expect(queue[2].isAutoplay).toBe(true); // Autoplay track must stay at the end
    expect(queue[2].title).toBe('A1');
  });
});
