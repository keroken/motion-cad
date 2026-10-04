#include "LeapC.h"
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>

static volatile sig_atomic_t running = 1;
static void stop(int signal_number) { (void)signal_number; running = 0; }

static void vector_json(LEAP_VECTOR value) {
  printf("[%.3f,%.3f,%.3f]", value.x, value.y, value.z);
}

static void digit_json(const LEAP_DIGIT* digit) {
  putchar('[');
  vector_json(digit->bones[0].prev_joint);
  for (int bone = 0; bone < 4; bone++) {
    putchar(',');
    vector_json(digit->bones[bone].next_joint);
  }
  putchar(']');
}

static void hand_json(const LEAP_HAND* hand) {
  printf("{\"id\":%u,\"type\":\"%s\",\"palm\":", hand->id,
    hand->type == eLeapHandType_Left ? "left" : "right");
  vector_json(hand->palm.position);
  printf(",\"palmNormal\":");
  vector_json(hand->palm.normal);
  printf(",\"pinchStrength\":%.4f,\"grabStrength\":%.4f,\"joints\":{\"wrist\":[",
    hand->pinch_strength, hand->grab_strength);
  vector_json(hand->arm.next_joint);
  putchar(',');
  vector_json(hand->palm.position);
  printf("],\"thumb\":"); digit_json(&hand->thumb);
  printf(",\"index\":"); digit_json(&hand->index);
  printf(",\"middle\":"); digit_json(&hand->middle);
  printf(",\"ring\":"); digit_json(&hand->ring);
  printf(",\"pinky\":"); digit_json(&hand->pinky);
  printf("}}");
}

int main(void) {
  signal(SIGINT, stop);
  signal(SIGTERM, stop);
  LEAP_CONNECTION connection = NULL;
  if (LeapCreateConnection(NULL, &connection) != eLeapRS_Success ||
      LeapOpenConnection(connection) != eLeapRS_Success) {
    fprintf(stderr, "Unable to open LeapC connection\n");
    return 2;
  }

  fprintf(stderr, "LeapC connection opened\n");
  while (running) {
    LEAP_CONNECTION_MESSAGE message;
    eLeapRS result = LeapPollConnection(connection, 1000, &message);
    if (result != eLeapRS_Success) continue;
    if (message.type == eLeapEventType_Connection) {
      fprintf(stderr, "Ultraleap service connected\n");
    } else if (message.type == eLeapEventType_ConnectionLost) {
      fprintf(stderr, "Ultraleap service connection lost\n");
    } else if (message.type == eLeapEventType_Device) {
      fprintf(stderr, "Ultraleap device connected\n");
    } else if (message.type == eLeapEventType_DeviceLost) {
      fprintf(stderr, "Ultraleap device disconnected\n");
    } else if (message.type == eLeapEventType_Tracking) {
      const LEAP_TRACKING_EVENT* frame = message.tracking_event;
      printf("{\"type\":\"frame\",\"id\":%lld,\"fps\":%.2f,\"hands\":[",
        (long long)frame->tracking_frame_id, frame->framerate);
      for (uint32_t i = 0; i < frame->nHands; i++) {
        if (i) putchar(',');
        hand_json(&frame->pHands[i]);
      }
      printf("]}\n");
      fflush(stdout);
    }
  }

  LeapCloseConnection(connection);
  LeapDestroyConnection(connection);
  return 0;
}
