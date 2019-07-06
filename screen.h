#pragma once



#include <stdbool.h>


typedef unsigned char u8;
typedef unsigned short u16;
typedef unsigned int u32;
typedef unsigned long long u64;

typedef signed char s8;
typedef signed short s16;
typedef signed int s32;
typedef signed long long s64;

typedef float f32;
typedef double f64;





void SCREEN_startup(void);
void SCREEN_destroy(void);


void SCREEN_enter(u32 w, u32 h);
void SCREEN_leave(void);
void SCREEN_resize(u32 w, u32 h);


void SCREEN_frame(f32 time);


void SCREEN_mouseUp(int x, int y);
void SCREEN_mouseDown(int x, int y);
void SCREEN_mouseMotion(int x, int y);


u32 SCREEN_screenWidth(void);
u32 SCREEN_screenHeight(void);

u32 SCREEN_renderWidth(void);
u32 SCREEN_renderHeight(void);

void SCREEN_setRenderSize(u32 w, u32 h);







enum
{
    SCREEN_Channels_MAX = 4,
    SCREEN_Buffers_MAX = 4,
};

typedef enum SCREEN_ChannelType
{
    SCREEN_ChannelType_Unused = 0,
    SCREEN_ChannelType_Buffer,
} SCREEN_ChannelType;

typedef struct SCREEN_Channel
{
    SCREEN_ChannelType type;
    union
    {
        u32 buffer;
    };
} SCREEN_Channel;

typedef struct SCREEN_RenderPass
{
    SCREEN_Channel channel[SCREEN_Channels_MAX];
    const char* shaderCode;
} SCREEN_RenderPass;

typedef struct SCREEN_Scene
{
    const char* shaderComm;
    SCREEN_RenderPass buffer[SCREEN_Buffers_MAX];
    SCREEN_RenderPass image;
} SCREEN_Scene;




bool SCREEN_loadScene(const SCREEN_Scene* scene);
void SCREEN_unloadScene(void);





















































































