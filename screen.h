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



#include "screen_keycode.h"



void SCREEN_startup(void);
void SCREEN_destroy(void);


void SCREEN_enter(u32 w, u32 h);
void SCREEN_leave(void);
void SCREEN_resize(u32 w, u32 h);


void SCREEN_sceneReset(void);
void SCREEN_frame(f32 dt, bool stopped);


void SCREEN_mouseUp(s32 x, s32 y);
void SCREEN_mouseDown(s32 x, s32 y);
void SCREEN_mouseMotion(s32 x, s32 y);

void SCREEN_keyUp(SCREEN_Key k);
void SCREEN_keyDown(SCREEN_Key k);


u32 SCREEN_screenWidth(void);
u32 SCREEN_screenHeight(void);

u32 SCREEN_renderWidth(void);
u32 SCREEN_renderHeight(void);


typedef enum SCREEN_RenderSizeMode
{
    SCREEN_RenderSizeMode_Scale = 0,
    SCREEN_RenderSizeMode_Fixed,
} SCREEN_RenderSizeMode;

typedef struct SCREEN_RenderSize
{
    SCREEN_RenderSizeMode mode;
    union
    {
        f32 scale;
        u32 size;
    };
} SCREEN_RenderSize;

const SCREEN_RenderSize* SCREEN_renderSize(void);
void SCREEN_setRenderSize(const SCREEN_RenderSize* rs);




enum
{
    SCREEN_Assets_MAX = 8,
    SCREEN_Channels_MAX = 4,
    SCREEN_Buffers_MAX = 4,
};




typedef enum SCREEN_AssetType
{
    SCREEN_AssetType_2D,
    SCREEN_AssetType_3D,
    SCREEN_AssetType_Cube,
    SCREEN_AssetTypeCount
} SCREEN_AssetType;

const char* SCREEN_AssetTypeNameTable(SCREEN_AssetType t);



typedef struct SCREEN_Asset
{
    SCREEN_AssetType type;
    u32 components;
    u32 size[3];
    u32 dataOffset;
    u32 dataSize;
    u32 cubeFaceDataSize[6];
} SCREEN_Asset;

u32 SCREEN_assetGpuDataSize(const SCREEN_Asset* asset);






typedef enum SCREEN_ChannelType
{
    SCREEN_ChannelType_Unused = 0,
    SCREEN_ChannelType_Buffer,
    SCREEN_ChannelType_Keyboard,
    SCREEN_ChannelType_Asset,
    SCREEN_ChannelTypeCount
} SCREEN_ChannelType;

typedef enum SCREEN_ChannelWrap
{
    SCREEN_ChannelWrap_Repeat = 0,
    SCREEN_ChannelWrap_Clamp,
    SCREEN_ChannelWrapCount
} SCREEN_ChannelWrap;

typedef enum SCREEN_ChannelFilter
{
    SCREEN_ChannelFilter_Mipmap = 0,
    SCREEN_ChannelFilter_Linear,
    SCREEN_ChannelFilter_Nearest,
    SCREEN_ChannelFilterCount
} SCREEN_ChannelFilter;

typedef struct SCREEN_Channel
{
    SCREEN_ChannelType type;
    union
    {
        u32 buffer;
        u32 asset;
    };
    SCREEN_ChannelWrap wrap;
    SCREEN_ChannelFilter filter;
} SCREEN_Channel;

typedef struct SCREEN_RenderPass
{
    SCREEN_Channel channel[SCREEN_Channels_MAX];
    u32 shaderCodeOffset;
} SCREEN_RenderPass;

typedef struct SCREEN_Scene
{
    u32 commonShaderCodeOffset;
    SCREEN_RenderPass buffer[SCREEN_Buffers_MAX];
    SCREEN_RenderPass image;
    u32 assetCount;
    SCREEN_Asset asset[SCREEN_Assets_MAX];
} SCREEN_Scene;




bool SCREEN_loadScene(const SCREEN_Scene* scene, const char* sceneData, u32 sceneDataSize);
void SCREEN_unloadScene(void);















































































