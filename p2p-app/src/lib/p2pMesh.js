/*
 * OpenMeet - P2PMesh Facade
 * Backward-compatible facade delegating to the modular MeetingController core.
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { MeetingController } from '../core/meeting/MeetingController.js';

export class P2PMesh extends MeetingController {
  constructor(options = {}) {
    super(options);
    if (options.stream) {
      this.replaceStream(options.stream);
    }
  }

  connect() {
    this.join();
  }
}
