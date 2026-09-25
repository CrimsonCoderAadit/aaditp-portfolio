"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { useSceneTransition } from "../scene/SceneTransition";
import { CHESS_LINE, firePulse, flipRoomToggle, playChess, selectSaber, setRoomToggle, toggleSaber, useChessGame, useRoomToggle, useSabers } from "../scene/roomInteractions";
import type { RoomFocus } from "../scene/viewpoints";
import { enterGameMode, prepareGameMode } from "../audio/gameMode";
import EscControl from "./EscControl";
import { SABER_INFO, SABER_ORDER } from "../scene/saberInfo";
import "./room.css";

// The console's front end loads when a visitor first sits down at it.
const ArcadeShell = dynamic(() => import("./arcade/ArcadeShell"), { ssr: false });

/** The DOM half of the room's interactive objects: the arcade and the chess
 * study's controls once the camera has arrived at them, Escape to step back
 * out, and a keyboard route to every object a pointer can use in the room. */
export default function RoomControls() {
  const { mode, touring, roomFocus, viewpoint, viewpointMoving, focusRoom, leaveRoomFocus } = useSceneTransition();
  const arrived = roomFocus !== null && viewpoint === roomFocus && !viewpointMoving;
  const inRoom = mode === "workbench" && !touring;

  useEffect(() => {
    if (!roomFocus) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      leaveRoomFocus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [roomFocus, leaveRoomFocus]);

  if (!inRoom) return null;
  if (roomFocus === "media") return arrived ? <ArcadeShell onExit={leaveRoomFocus} /> : null;
  if (roomFocus === "chess") return arrived ? <ChessControls onBack={leaveRoomFocus} /> : null;
  if (roomFocus === "kong") return arrived ? <PrintControls onBack={leaveRoomFocus} /> : null;
  if (roomFocus === "chase") return arrived ? <ChaseControls onBack={leaveRoomFocus} /> : null;
  if (roomFocus === "sabers") return arrived ? <SaberControls onBack={leaveRoomFocus} /> : null;
  return <RoomKeyboard disabled={viewpointMoving} focusRoom={focusRoom} />;
}

function ChessControls({ onBack }: { onBack: () => void }) {
  const { ply } = useChessGame();
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => { back.current?.focus({ preventScroll: true }); }, []);
  const done = ply >= CHESS_LINE.length;
  return (
    <section className="room-focus-bar" aria-label="Chess study">
      <EscControl label="Back to room" onPress={onBack} />
      <button ref={back} type="button" className="room-focus-back" onClick={onBack}>← Back to room</button>
      <p className="room-focus-note" aria-live="polite">{done ? <><strong>Scholar&apos;s Mate</strong> {CHESS_LINE.join(" ")}</> : CHESS_LINE.slice(0, ply).join(" ") || "Setting up the board"}</p>
      <button type="button" className="room-focus-action" onClick={playChess}>{done ? "Play again" : "Restart"}</button>
    </section>
  );
}

function PrintControls({ onBack }: { onBack: () => void }) {
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => { back.current?.focus({ preventScroll: true }); }, []);
  return (
    <section className="room-focus-bar" aria-label="Gaming wall">
      <EscControl label="Back to room" onPress={onBack} />
      <button ref={back} type="button" className="room-focus-back" onClick={onBack}>← Back to room</button>
      <p className="room-focus-note">Original pixel art of an arcade legend, and a detective from the brick city</p>
      <button type="button" className="room-focus-action" onClick={() => firePulse("kong")}>Replay</button>
    </section>
  );
}

function ChaseControls({ onBack }: { onBack: () => void }) {
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => { back.current?.focus({ preventScroll: true }); }, []);
  return (
    <section className="room-focus-bar" aria-label="The detective">
      <EscControl label="Back to room" onPress={onBack} />
      <button ref={back} type="button" className="room-focus-back" onClick={onBack}>← Back to room</button>
      <p className="room-focus-note">An undercover detective on the Projects campus, and a knocked-over cone</p>
      <button type="button" className="room-focus-action" onClick={() => firePulse("chase")}>Lights</button>
    </section>
  );
}

/** The saber collection's bar: the picked-out hilt's character, blade and
 * line, a way to step between hilts without a pointer, and its blade switch. */
function SaberControls({ onBack }: { onBack: () => void }) {
  const { selected, lit } = useSabers();
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => { back.current?.focus({ preventScroll: true }); }, []);
  const info = selected ? SABER_INFO[selected] : null;
  const step = (by: number) => {
    const index = selected ? SABER_ORDER.indexOf(selected) : by > 0 ? -1 : 0;
    selectSaber(SABER_ORDER[(index + by + SABER_ORDER.length) % SABER_ORDER.length]);
  };
  return (
    <section className="room-focus-bar saber-bar" aria-label="Lightsaber collection">
      <EscControl label="Back to room" onPress={onBack} />
      <button ref={back} type="button" className="room-focus-back" onClick={onBack}>← Back to room</button>
      <div className="saber-info" aria-live="polite">
        {info ? <>
          <p className="saber-name">{info.name}<span>{info.blade}</span></p>
          <p className="saber-line">{info.quote ? `“${info.line}”` : info.line}</p>
        </> : <p className="saber-line">Five sabers. Point at a hilt, or tap it, to see whose it is.</p>}
      </div>
      <div className="saber-actions">
        <button type="button" className="room-focus-action" aria-label="Previous saber" onClick={() => step(-1)}>←</button>
        <button type="button" className="room-focus-action" aria-label="Next saber" onClick={() => step(1)}>→</button>
        <button type="button" className="room-focus-action" disabled={!selected} onClick={() => selected && toggleSaber(selected)}>{selected && lit[selected] ? "Retract" : "Ignite"}</button>
      </div>
    </section>
  );
}

/** Visually hidden until focused, like the section entries. */
function RoomKeyboard({ disabled, focusRoom }: { disabled: boolean; focusRoom: (target: RoomFocus) => void }) {
  const wardrobe = useRoomToggle("wardrobe");
  const bedside = useRoomToggle("bedsideLamp");
  const floor = useRoomToggle("floorLamp");
  const dimmed = useRoomToggle("coveDimmed");
  const curtains = useRoomToggle("curtains");
  const electronics = useRoomToggle("electronicsDrawer");
  const bricks = useRoomToggle("brickDrawer");
  const pegLamp = useRoomToggle("pegLamp");
  const actions = [
    { id: "wardrobe", label: wardrobe ? "Close the wardrobe" : "Open the wardrobe", act: () => flipRoomToggle("wardrobe") },
    { id: "curtains", label: curtains ? "Open the curtains" : "Close the curtains", act: () => flipRoomToggle("curtains") },
    { id: "electronics", label: electronics ? "Close the electronics drawer" : "Open the electronics drawer", act: () => flipRoomToggle("electronicsDrawer") },
    { id: "bricks", label: bricks ? "Close the brick drawer" : "Open the brick drawer", act: () => flipRoomToggle("brickDrawer") },
    { id: "tower", label: "Light the skyscraper model", act: () => firePulse("tower") },
    { id: "tape", label: "Run out the tape measure", act: () => firePulse("tape") },
    { id: "peg-lamp", label: pegLamp ? "Switch off the pegboard lamp" : "Switch on the pegboard lamp", act: () => flipRoomToggle("pegLamp") },
    { id: "media", label: "Sit down at the media corner", act: () => { enterGameMode(); focusRoom("media"); } },
    { id: "chess", label: "Look at the chess study", act: () => focusRoom("chess") },
    { id: "kong", label: "Look at the gaming wall", act: () => focusRoom("kong") },
    { id: "chase", label: "Look closer at the detective", act: () => focusRoom("chase") },
    { id: "flute", label: "Play the flute in the wardrobe", act: () => { setRoomToggle("wardrobe", true); firePulse("flute"); } },
    { id: "football", label: "Nudge the football", act: () => firePulse("football") },
    { id: "vader", label: "Wake the brick figure's saber", act: () => firePulse("vader") },
    { id: "sabers", label: "Look at the lightsaber collection", act: () => focusRoom("sabers") },
    { id: "bedside", label: bedside ? "Turn off the bedside lamp" : "Turn on the bedside lamp", act: () => flipRoomToggle("bedsideLamp") },
    { id: "floor", label: floor ? "Turn off the floor lamp" : "Turn on the floor lamp", act: () => flipRoomToggle("floorLamp") },
    { id: "cove", label: dimmed ? "Brighten the ceiling light" : "Dim the ceiling light", act: () => flipRoomToggle("coveDimmed") },
  ];
  return (
    <div className="room-keyboard" role="group" aria-label="Room objects">
      {actions.map(({ id, label, act }) => <button key={id} type="button" className="projects-keyboard-entry" disabled={disabled} onClick={act}
        onFocus={id === "media" ? prepareGameMode : undefined}>{label}</button>)}
    </div>
  );
}
