#pragma once



#include "screen_fileloader.h"



void SCREEN_fwtchStartup(void);
void SCREEN_fwtchDestroy(void);

SCREEN_LoadFileError SCREEN_fwtchScreenBind(const char* filename);
SCREEN_LoadFileError SCREEN_fwtchConfigBind(const char* filename);

void SCREEN_fwtchScreenUnbind(void);
void SCREEN_fwtchConfigUnbind(void);

bool SCREEN_fwtchUpdate(void);




























































































