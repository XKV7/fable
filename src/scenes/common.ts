import type { Input } from '../core/input';
import type { PlayerInput } from '../game/player';

export function readPlayerInput(i: Input): PlayerInput {
  return {
    left: i.held('left'),
    right: i.held('right'),
    up: i.held('up'),
    down: i.held('down'),
    jumpP: i.pressed('jump'),
    jumpH: i.held('jump'),
    atkP: i.pressed('attack'),
    dashP: i.pressed('dash'),
    s1P: i.pressed('skill1'),
    s2P: i.pressed('skill2'),
    swapP: i.pressed('swap'),
    interactP: i.pressed('interact'),
    itemP: i.pressed('item'),
  };
}
