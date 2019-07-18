#pragma once


#include "screen.h"



typedef struct SCREEN_SyncOpt
{
    bool enablePush;
    bool enableRecv;
} SCREEN_SyncOpt;



void SCREEN_syncServerStartup(void);
void SCREEN_syncServerDestroy(void);



void SCREEN_syncClientStartup(const char* url);
void SCREEN_syncClientDestroy(void);






































































