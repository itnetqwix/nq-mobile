/**
 * Shared types for the mobile portrait-calling stack. These mirror the contracts the
 * website's `app/components/portrait-calling` ecosystem uses so a future native WebRTC
 * implementation can drop in without changing the surrounding screen / controls UI.
 *
 *  Web reference:
 *  - `app/components/portrait-calling/index.jsx` (VideoCallUI orchestrator)
 *  - `app/components/video/callEngine.js` (peer / ICE)
 *  - `helpers/events.ts → EVENTS.VIDEO_CALL` (signaling event names)
 */

export type SessionRole = "Trainer" | "Trainee";

export type CallParticipant = {
  _id: string;
  fullname?: string;
  fullName?: string;
  profile_picture?: string;
};

export type IceServer = { urls: string | string[]; username?: string; credential?: string };

export type CallSessionInfo = {
  lessonId: string;
  fromUser: CallParticipant;
  toUser: CallParticipant;
  role: SessionRole;
  sessionStartTime?: string;
  sessionEndTime?: string;
  bookedDate?: string;
  iceServers?: IceServer[];
  isInstantLesson?: boolean;
};

export type CallEngineStatus =
  | "idle"
  | "preparing"
  | "joining"
  | "ringing"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "ended"
  | "failed";

export type CallEngineState = {
  status: CallEngineStatus;
  remoteJoined: boolean;
  bothJoined: boolean;
  micEnabled: boolean;
  cameraEnabled: boolean;
  facingMode: "user" | "environment";
};
