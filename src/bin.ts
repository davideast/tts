#!/usr/bin/env node
import { runMain } from 'citty';
import { mainCommand } from './cli/command.js';

runMain(mainCommand);
